#!/bin/bash
# Scripted proof for the V1.1 RBAC requirements -- asserts actual response
# status/payload per role/endpoint against a running staging environment,
# rather than relying on visual inspection. Requires the staging-only seed
# fixtures (apps/backend/prisma/seed.ts, SEED_RBAC_TEST_USERS=true) to
# already exist: two data rooms (A with 6 external-role test members, B
# with none) plus the org admin.
#
# Usage: ./infrastructure/scripts/verify-rbac.sh [base-url]
#   Defaults to https://staging.vdr.variedreach.com/api/v1 -- deliberately
#   does not default to production; pass it explicitly if ever needed there.
set -uo pipefail

BASE_URL="${1:-https://staging.vdr.variedreach.com/api/v1}"
ROOM_A="00000000-0000-0000-0000-0000000000aa"
ROOM_B="00000000-0000-0000-0000-0000000000bb"
PASSWORD="RbacTest123!"
ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:?Set SEED_ADMIN_PASSWORD to the staging org admin password}"

PASS=0
FAIL=0

declare -A TOKEN

login() {
  local email="$1" password="$2"
  curl -sk -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('accessToken',''))"
}

# check NAME METHOD PATH ROLE EXPECTED_STATUS [jq-ish python expr on parsed json, optional]
check() {
  local name="$1" method="$2" path="$3" role="$4" expected="$5" assertion="${6:-}"
  local token="${TOKEN[$role]}"
  local response status body

  response=$(curl -sk -w "\n%{http_code}" -X "$method" "$BASE_URL$path" -H "Authorization: Bearer $token")
  status=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ "$status" != "$expected" ]; then
    echo "FAIL  $name [$role] -- expected $expected, got $status"
    FAIL=$((FAIL + 1))
    return
  fi

  if [ -n "$assertion" ]; then
    if ! echo "$body" | python3 -c "
import sys, json
d = json.load(sys.stdin)
data = d.get('data', d)
assert ($assertion), 'assertion failed on: ' + json.dumps(data)[:300]
" 2>/tmp/rbac-assert-err; then
      echo "FAIL  $name [$role] -- status ok ($status) but payload assertion failed: $(cat /tmp/rbac-assert-err | tail -1)"
      FAIL=$((FAIL + 1))
      return
    fi
  fi

  echo "PASS  $name [$role] -- $status"
  PASS=$((PASS + 1))
}

echo "=== Logging in as each role ==="
TOKEN[ORG_ADMIN]=$(login "admin@insolvencyvdr.local" "$ADMIN_PASSWORD")
TOKEN[RP_LIQUIDATOR]=$(login "rbac-rp-liquidator@staging.test" "$PASSWORD")
TOKEN[PRA]=$(login "rbac-pra@staging.test" "$PASSWORD")
TOKEN[COC_MEMBER]=$(login "rbac-coc-member@staging.test" "$PASSWORD")
TOKEN[AUDITOR]=$(login "rbac-auditor@staging.test" "$PASSWORD")
TOKEN[LEGAL_ADVISOR]=$(login "rbac-legal-advisor@staging.test" "$PASSWORD")
TOKEN[GUEST]=$(login "rbac-guest@staging.test" "$PASSWORD")

declare -A USER_ID
decode_sub() {
  python3 -c "
import sys, json, base64
token = sys.argv[1]
payload = token.split('.')[1]
payload += '=' * (-len(payload) % 4)
print(json.loads(base64.urlsafe_b64decode(payload)).get('sub', ''))
" "$1"
}

for role in ORG_ADMIN RP_LIQUIDATOR PRA COC_MEMBER AUDITOR LEGAL_ADVISOR GUEST; do
  if [ -z "${TOKEN[$role]}" ]; then
    echo "FATAL: login failed for $role -- aborting"
    exit 1
  fi
  USER_ID[$role]=$(decode_sub "${TOKEN[$role]}")
done
echo "All 7 logins succeeded."
echo

echo "=== Req #1: Members visibility (manager tier only) ==="
check "members list" GET "/data-rooms/$ROOM_A/members" ORG_ADMIN 200
check "members list" GET "/data-rooms/$ROOM_A/members" RP_LIQUIDATOR 200
check "members list" GET "/data-rooms/$ROOM_A/members" PRA 403
check "members list" GET "/data-rooms/$ROOM_A/members" COC_MEMBER 403
check "members list" GET "/data-rooms/$ROOM_A/members" AUDITOR 403
check "members list" GET "/data-rooms/$ROOM_A/members" LEGAL_ADVISOR 403
check "members list" GET "/data-rooms/$ROOM_A/members" GUEST 403
echo

echo "=== Req #3: Data room visibility (no org-wide knowledge for external roles) ==="
check "data room list" GET "/data-rooms" PRA 200 "len(data) == 1 and data[0]['id'] == '$ROOM_A'"
check "data room list" GET "/data-rooms" GUEST 200 "len(data) == 1 and data[0]['id'] == '$ROOM_A'"
check "data room list" GET "/data-rooms" ORG_ADMIN 200 "len(data) >= 2"
check "room B direct access" GET "/data-rooms/$ROOM_B" PRA 403
check "room B direct access" GET "/data-rooms/$ROOM_B" ORG_ADMIN 200
echo

echo "=== Req #2: Dashboard visibility ==="
check "dashboard stats" GET "/dashboard/stats" PRA 200 "'assignedDataRooms' in data and 'activeDataRooms' not in data"
check "dashboard stats" GET "/dashboard/stats" GUEST 200 "'assignedDataRooms' in data and 'activeDataRooms' not in data"
check "dashboard stats" GET "/dashboard/stats" ORG_ADMIN 200 "'activeDataRooms' in data and 'assignedDataRooms' not in data"
echo

echo "=== Req #7: Activity (own-only for external roles, full for managers) ==="
check "activity own-rows-only" GET "/data-rooms/$ROOM_A/audit-logs" PRA 200 \
  "all(row.get('userId') == '${USER_ID[PRA]}' for row in data)"
check "activity own-rows-only" GET "/data-rooms/$ROOM_A/audit-logs" GUEST 200 \
  "all(row.get('userId') == '${USER_ID[GUEST]}' for row in data)"
check "activity full for manager" GET "/data-rooms/$ROOM_A/audit-logs" ORG_ADMIN 200
check "activity, non-member" GET "/data-rooms/$ROOM_B/audit-logs" PRA 403
echo

echo "=== Req #6: Reports (manager tier only) ==="
check "reports user-activity" GET "/data-rooms/$ROOM_A/reports/user-activity?format=json" ORG_ADMIN 200
check "reports user-activity" GET "/data-rooms/$ROOM_A/reports/user-activity?format=json" RP_LIQUIDATOR 200
check "reports user-activity" GET "/data-rooms/$ROOM_A/reports/user-activity?format=json" PRA 403
check "reports user-activity" GET "/data-rooms/$ROOM_A/reports/user-activity?format=json" COC_MEMBER 403
check "reports user-activity" GET "/data-rooms/$ROOM_A/reports/user-activity?format=json" AUDITOR 403
check "reports user-activity" GET "/data-rooms/$ROOM_A/reports/user-activity?format=json" GUEST 403
echo

echo "=== Req #4: File permission tiers (fake file id -- 403 proves the role gate, 404 proves it passed the gate) ==="
FAKE_FILE="00000000-0000-0000-0000-0000000000ff"
# rename/move -> CONTENT_MANAGER_ROLES (SUPER_ADMIN/ORG_ADMIN/RP_LIQUIDATOR/AUDITOR)
check "file rename gate" PATCH "/data-rooms/$ROOM_A/files/$FAKE_FILE" ORG_ADMIN 404
check "file rename gate" PATCH "/data-rooms/$ROOM_A/files/$FAKE_FILE" RP_LIQUIDATOR 404
check "file rename gate" PATCH "/data-rooms/$ROOM_A/files/$FAKE_FILE" AUDITOR 404
check "file rename gate" PATCH "/data-rooms/$ROOM_A/files/$FAKE_FILE" PRA 403
check "file rename gate" PATCH "/data-rooms/$ROOM_A/files/$FAKE_FILE" COC_MEMBER 403
check "file rename gate" PATCH "/data-rooms/$ROOM_A/files/$FAKE_FILE" LEGAL_ADVISOR 403
check "file rename gate" PATCH "/data-rooms/$ROOM_A/files/$FAKE_FILE" GUEST 403
# delete -> CONTENT_DELETE_ROLES (excludes Auditor specifically)
check "file delete gate" DELETE "/data-rooms/$ROOM_A/files/$FAKE_FILE" ORG_ADMIN 404
check "file delete gate" DELETE "/data-rooms/$ROOM_A/files/$FAKE_FILE" RP_LIQUIDATOR 404
check "file delete gate (auditor excluded)" DELETE "/data-rooms/$ROOM_A/files/$FAKE_FILE" AUDITOR 403
check "file delete gate" DELETE "/data-rooms/$ROOM_A/files/$FAKE_FILE" PRA 403
# download -> NO_DOWNLOAD_ROLES (Guest only)
check "file download gate (guest excluded)" GET "/data-rooms/$ROOM_A/files/$FAKE_FILE/download" GUEST 403
check "file download gate" GET "/data-rooms/$ROOM_A/files/$FAKE_FILE/download" PRA 404
check "file download gate" GET "/data-rooms/$ROOM_A/files/$FAKE_FILE/download" ORG_ADMIN 404
echo

echo "=== Results ==="
echo "PASS: $PASS   FAIL: $FAIL"
[ "$FAIL" -eq 0 ]
