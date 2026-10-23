import json
import asyncio
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
from types import SimpleNamespace
from api.precompute_eleven import trial_preflight, main

class TestTrialGuard(unittest.TestCase):
    def replies(self, state='Enabled', limit='On', quota='FreeTrial_2014-09-01'):
        return [SimpleNamespace(stdout=json.dumps(x)) for x in [
            {'id':'test-subscription'},
            {'state':state,'subscriptionPolicies':{'spendingLimit':limit,'quotaId':quota}},
            [{'name':'gpt-4.1-mini','properties':{'model':{'name':'gpt-4.1-mini'},'provisioningState':'Succeeded'}}]
        ]]
    def test_only_protected_free_trial_is_accepted(self):
        with patch('api.precompute_eleven.subprocess.run',side_effect=self.replies()):
            self.assertEqual(trial_preflight()['spendingLimit'],'On')
        for kwargs in [{'limit':'Off'},{'limit':'CurrentPeriodOff'},{'state':'Disabled'},{'quota':'PayAsYouGo'}]:
            with patch('api.precompute_eleven.subprocess.run',side_effect=self.replies(**kwargs)):
                with self.assertRaises(RuntimeError): trial_preflight()

    def test_existing_or_pending_publication_rejected_before_credentials_or_calls(self):
        for pending in (False,True):
            with tempfile.TemporaryDirectory() as directory:
                target=Path(directory)/'publication.json'
                (target.with_suffix('.pending.json') if pending else target).write_text('{}')
                with patch('sys.argv',['precompute','--confirm-trial-credits','--output',str(target)]), patch('api.precompute_eleven.trial_preflight') as credentials:
                    with self.assertRaises(FileExistsError): asyncio.run(main())
                    credentials.assert_not_called()
