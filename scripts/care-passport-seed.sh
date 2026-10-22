#!/bin/bash
# Creates the Care Passport demo users and groups in the local realm (idempotent).
# Demo emails are fake (@carepassport.example): the realm requires the field, never use real addresses here.
# On a multiAdmin realm these governed writes return 202 and wait as change requests:
# a tide-realm-admin must approve them in the admin console (Change Requests).
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
U="${TIDECLOAK_URL:-http://localhost:8080}"; R=care-passport

tok() {
  curl -s -X POST "$U/realms/master/protocol/openid-connect/token" -d client_id=admin-cli -d grant_type=password \
    --data-urlencode "username=$KC_BOOTSTRAP_ADMIN_USERNAME" --data-urlencode "password=$KC_BOOTSTRAP_ADMIN_PASSWORD" | jq -r .access_token
}

for u in patient1 gp1 physio1; do
  have=$(curl -s "$U/admin/realms/$R/users?username=$u&exact=true" -H "Authorization: Bearer $(tok)" | jq 'length')
  if [ "$have" != "0" ]; then echo "user $u: exists"; continue; fi
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$U/admin/realms/$R/users" -H "Authorization: Bearer $(tok)" \
    -H "Content-Type: application/json" -d "{\"username\":\"$u\",\"email\":\"$u@carepassport.example\",\"firstName\":\"Demo\",\"lastName\":\"$u\",\"enabled\":true,\"emailVerified\":false,\"attributes\":{\"tideInvitable\":[\"true\"]}}")
  echo "user $u: HTTP $code (201 created, 202 queued as change request)"
done

for g in p1-owner p1-care-team; do
  have=$(curl -s "$U/admin/realms/$R/groups?search=$g&exact=true" -H "Authorization: Bearer $(tok)" | jq 'length')
  if [ "$have" != "0" ]; then echo "group $g: exists"; continue; fi
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$U/admin/realms/$R/groups" -H "Authorization: Bearer $(tok)" \
    -H "Content-Type: application/json" -d "{\"name\":\"$g\"}")
  echo "group $g: HTTP $code"
done

echo "pending change requests:"
curl -s "$U/admin/realms/$R/iga/change-requests?status=PENDING" -H "Authorization: Bearer $(tok)" \
  | jq -r '.[] | "  \(.actionType)  \(.entityType)  id=\(.id)"'
