import json
import unittest
from unittest.mock import patch
from types import SimpleNamespace
from api.precompute_eleven import trial_preflight

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
