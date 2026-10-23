"""One finite owner-authorised test; private approval is not browser input."""
from datetime import datetime, timezone
import hashlib
import json
import math
import os

AUTHORIZATION_ID = 'issue40-seed82-winner'
APPROVED_MOMENT = '82/4680.25'
APPROVAL_PATH = f'live/approvals/{AUTHORIZATION_ID}.json'
MAX_CALLS, MAX_OUTPUT_TOKENS, MAX_INPUT_BYTES = 3, 1000, 16000


def source_sha256(source):
    return hashlib.sha256(json.dumps(source, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def verify_approval(approval, source, *, now=None):
    now = now or datetime.now(timezone.utc)
    expected_hash = os.environ.get('TACTICLENS_LIVE_SOURCE_SHA256', '')
    if not isinstance(approval, dict) or approval.get('schemaVersion') != 'tacticlens.live-approval.v1':
        raise ValueError('Missing private owner approval')
    if (approval.get('authorizationId') != AUTHORIZATION_ID or approval.get('moment') != APPROVED_MOMENT
            or approval.get('subscriptionId') != os.environ.get('TACTICLENS_AZURE_SUBSCRIPTION_ID')
            or not expected_hash or approval.get('sourceSha256') != expected_hash
            or source_sha256(source) != expected_hash
            or approval.get('limits') != dict(modelCalls=MAX_CALLS, outputTokensPerCall=MAX_OUTPUT_TOKENS,
                                             inputBytesPerCall=MAX_INPUT_BYTES, automaticRetries=0)):
        raise ValueError('Approval/source/budget mismatch')
    checked = datetime.fromisoformat(approval['creditsCheckedAt'].replace('Z', '+00:00'))
    expires = datetime.fromisoformat(approval['expiresAt'].replace('Z', '+00:00'))
    credit = approval.get('remainingCredit', {})
    value = credit.get('value')
    if (type(value) not in (int, float) or not math.isfinite(value) or value < 1
            or credit.get('currency') != 'USD' or not 0 <= (now-checked).total_seconds() <= 600
            or not checked <= now < expires or (expires-checked).total_seconds() > 600
            or approval.get('subscriptionType') != 'FreeTrial' or approval.get('spendingLimit') != 'On'):
        raise ValueError('Credit check is stale, absent or unsafe')
    return approval
