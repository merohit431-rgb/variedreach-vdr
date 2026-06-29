import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { generateOpaqueToken, sha256Hex } from '../../common/utils/crypto.util';
import { CreateRegistrationDto } from './dto/create-registration.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class RegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: CreateRegistrationDto): Promise<void> {
    const existing = await this.prisma.registration.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email has already been registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const registration = await this.prisma.registration.create({
      data: {
        fullName: dto.fullName,
        companyName: dto.companyName,
        email: dto.email,
        mobileNumber: dto.mobileNumber,
        passwordHash,
        gstNumber: dto.gstNumber,
        companyAddress: dto.companyAddress,
        selectedPlan: dto.selectedPlan,
        selectedStorageGb: dto.selectedStorageGb,
      },
    });

    await this.issueVerificationToken(registration.id, registration.fullName, registration.email);
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = sha256Hex(token);
    const registration = await this.prisma.registration.findUnique({ where: { verificationTokenHash: tokenHash } });

    if (
      !registration ||
      registration.verifiedAt ||
      !registration.verificationExpiresAt ||
      registration.verificationExpiresAt < new Date()
    ) {
      throw new BadRequestException('Verification link is invalid or has expired');
    }

    await this.prisma.registration.update({
      where: { id: registration.id },
      data: { verifiedAt: new Date(), verificationTokenHash: null, verificationExpiresAt: null },
    });
  }

  async resendVerification(email: string): Promise<void> {
    const registration = await this.prisma.registration.findUnique({ where: { email } });

    // Same shape regardless of whether the email exists or is already
    // verified -- avoids using this endpoint to enumerate registrations.
    if (!registration || registration.verifiedAt) {
      return;
    }

    await this.issueVerificationToken(registration.id, registration.fullName, registration.email);
  }

  private async issueVerificationToken(registrationId: string, fullName: string, email: string): Promise<void> {
    const { raw, hash } = generateOpaqueToken();
    const expiresHours = this.configService.get<number>('jwt.registrationVerificationExpiresHours')!;

    await this.prisma.registration.update({
      where: { id: registrationId },
      data: {
        verificationTokenHash: hash,
        verificationExpiresAt: new Date(Date.now() + expiresHours * 60 * 60_000),
      },
    });

    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    const verifyUrl = `${frontendUrl}/verify-email?token=${raw}`;

    await this.mailService.sendEmailVerificationEmail(email, fullName, verifyUrl);
  }
}
