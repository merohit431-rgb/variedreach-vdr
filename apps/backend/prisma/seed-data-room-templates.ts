// Seeds data_room_templates / data_room_template_folders. Idempotent: each
// template is upserted by its unique dataRoomType, and its folder tree is
// fully replaced (delete-then-recreate, cascade-safe since
// DataRoomTemplateFolder.templateId cascades) rather than diffed -- the
// template definitions here are the source of truth, not whatever happened
// to already be in the table.
//
// Run with: npx ts-node --transpile-only prisma/seed-data-room-templates.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TemplateFolderNode {
  name: string;
  children?: TemplateFolderNode[];
}

interface TemplateDefinition {
  dataRoomType: 'CIRP' | 'IPO';
  name: string;
  description: string;
  folders: TemplateFolderNode[];
}

// Migrated verbatim from the earlier hardcoded CIRP_DEFAULT_FOLDERS array --
// same 15 names, same order, now rows instead of a TS constant. A room
// created under this template looks identical to one seeded by the old code.
const CIRP_TEMPLATE: TemplateDefinition = {
  dataRoomType: 'CIRP',
  name: 'CIRP (Corporate Insolvency Resolution Process)',
  description:
    'Client-specific default folder structure for CIRP data rooms (Maharashtra real-estate developer insolvency — MahaRERA/BMC references are specific to this engagement, not a generic IBC template).',
  folders: [
    { name: 'A. Certificates issued by various authorities' },
    { name: 'B. Vendor Construction Contracts' },
    { name: 'C. Homebuyers and allottees records' },
    { name: 'D. Drawings' },
    { name: 'E. Agreement pertaining to TWO LAND Parcels' },
    { name: 'F. Financials' },
    { name: 'G. Details of securities' },
    { name: 'H. Statutory details' },
    { name: 'I. Income Tax & GST returns' },
    { name: 'J. Litigation data' },
    { name: 'K. Title Deeds' },
    { name: 'L. Property Card & DP Remark' },
    { name: 'M. MAHARERA Documents' },
    { name: 'N. BMC Documents' },
    { name: 'O. Legal Notices received in the matter' },
  ],
};

const IPO_TEMPLATE: TemplateDefinition = {
  dataRoomType: 'IPO',
  name: 'IPO — Initial Public Offering',
  description:
    'Initial template for CA firms, merchant bankers, legal advisors and due-diligence teams working on an IPO engagement. Not a mandatory legal checklist — every folder here can be renamed, removed, reordered, or supplemented after the room is created.',
  folders: [
    {
      name: 'Corporate Information',
      children: [
        { name: 'Certificate of Incorporation' },
        { name: 'Memorandum and Articles of Association' },
        { name: 'Corporate Structure' },
        { name: 'Board Resolutions' },
        { name: 'Shareholding Structure' },
        { name: 'Statutory Registrations' },
      ],
    },
    {
      name: 'Financial Information',
      children: [
        { name: 'Audited Financial Statements' },
        { name: 'Provisional Financial Statements' },
        { name: 'Financial Projections' },
        { name: 'Tax Audits' },
        { name: 'Accounting Policies' },
        { name: 'Revenue Details' },
        { name: 'Related Party Transactions' },
      ],
    },
    {
      name: 'Legal and Regulatory',
      children: [
        { name: 'Litigation and Disputes' },
        { name: 'Material Agreements' },
        { name: 'Regulatory Approvals' },
        { name: 'Licences and Registrations' },
        { name: 'Legal Opinions' },
        { name: 'Compliance Records' },
      ],
    },
    {
      name: 'Taxation',
      children: [
        { name: 'Income Tax Returns' },
        { name: 'GST Returns' },
        { name: 'Tax Assessments' },
        { name: 'Tax Notices' },
        { name: 'Tax Payments' },
        { name: 'Tax Litigation' },
      ],
    },
    {
      name: 'Business and Operations',
      children: [
        { name: 'Business Overview' },
        { name: 'Business Model' },
        { name: 'Customer Information' },
        { name: 'Vendor Information' },
        { name: 'Material Contracts' },
        { name: 'Intellectual Property' },
        { name: 'Operational Documents' },
      ],
    },
    {
      name: 'Human Resources',
      children: [
        { name: 'Employee Information' },
        { name: 'Key Management Personnel' },
        { name: 'Employment Agreements' },
        { name: 'Employee Benefits' },
        { name: 'ESOP Details' },
      ],
    },
    {
      name: 'Shareholding and Capitalisation',
      children: [
        { name: 'Existing Shareholding' },
        { name: 'Capital Structure' },
        { name: 'Share Transfer Records' },
        { name: 'Shareholder Agreements' },
        { name: 'Securities Issuances' },
      ],
    },
    {
      name: 'Due Diligence',
      children: [
        { name: 'Financial Due Diligence' },
        { name: 'Legal Due Diligence' },
        { name: 'Tax Due Diligence' },
        { name: 'Secretarial Due Diligence' },
        { name: 'Management Responses' },
        { name: 'Supporting Documents' },
      ],
    },
    {
      name: 'IPO Documentation',
      children: [
        { name: 'Draft Offer Documents' },
        { name: 'DRHP/RHP' },
        { name: 'Offer Document Supporting Information' },
        { name: 'Merchant Banker Documents' },
        { name: 'Regulatory Correspondence' },
      ],
    },
    { name: 'Miscellaneous' },
  ],
};

async function seedTemplate(def: TemplateDefinition): Promise<void> {
  const template = await prisma.dataRoomTemplate.upsert({
    where: { dataRoomType: def.dataRoomType },
    create: { dataRoomType: def.dataRoomType, name: def.name, description: def.description },
    update: { name: def.name, description: def.description },
  });

  // Full replace: cascades from DataRoomTemplateFolder.templateId, so this
  // never touches real Folder rows in rooms already created from this
  // template -- only the template definition itself.
  await prisma.dataRoomTemplateFolder.deleteMany({ where: { templateId: template.id } });

  let sortCounter = 0;
  const createNodes = async (nodes: TemplateFolderNode[], parentId: string | null): Promise<void> => {
    for (const node of nodes) {
      const created = await prisma.dataRoomTemplateFolder.create({
        data: { templateId: template.id, parentId, name: node.name, sortOrder: sortCounter++ },
      });
      if (node.children) {
        await createNodes(node.children, created.id);
      }
    }
  };

  await createNodes(def.folders, null);

  const total = await prisma.dataRoomTemplateFolder.count({ where: { templateId: template.id } });
  console.log(`Seeded "${def.name}" (${def.dataRoomType}): ${total} folders`);
}

async function main() {
  await seedTemplate(CIRP_TEMPLATE);
  await seedTemplate(IPO_TEMPLATE);
}

main()
  .catch((err) => {
    console.error('Template seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
