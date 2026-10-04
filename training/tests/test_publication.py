import copy
import unittest
from common import load_species, SERVICE_LABELS
from promotion import publication_reasons
from workflow_config import normalize

class PublicationTest(unittest.TestCase):
    def test_calibration_regression_still_blocks_publication(self):
        labels = [s['id'] for s in load_species()] + SERVICE_LABELS
        metric = {'top1': .85, 'top3': .94, 'macroRecall': .8, 'testImages': 3000,
                  'eceAfter': .02, 'perClass': {}, 'decisions': {
                      'dangerous': 800, 'unknown': 400, 'unwarnedConfidentEdibleRate': .005,
                      'unknownAsConfidentRate': .02}}
        worse = copy.deepcopy(metric)
        worse['eceAfter'] = .09
        self.assertIn('Calibration regressed', publication_reasons(
            worse, metric, worse, labels, labels[:80] + SERVICE_LABELS))

    def test_regression_in_actual_warning_logic_blocks_publication(self):
        labels = [s['id'] for s in load_species()] + SERVICE_LABELS
        baseline_labels = labels[:80]
        metric = {'top1': .85, 'top3': .94, 'macroRecall': .8, 'testImages': 3000,
                  'eceAfter': .03, 'perClass': {}, 'decisions': {
                      'dangerous': 800, 'unknown': 400, 'unwarnedConfidentEdibleRate': .005,
                      'unknownAsConfidentRate': .02}}
        self.assertEqual(publication_reasons(metric, metric, metric, labels, baseline_labels), [])
        worse = copy.deepcopy(metric)
        worse['decisions']['unwarnedConfidentEdibleRate'] = .006
        reasons = publication_reasons(worse, metric, worse, labels, baseline_labels)
        self.assertTrue(any('regressed' in r for r in reasons))
        self.assertTrue(publication_reasons(metric, metric, metric, labels[:70], baseline_labels))

    def test_inputs_are_bounded_numbers_not_shell_expressions(self):
        self.assertEqual(normalize({'per_species': 1200})['per_species'], '1200')
        for value in ['$(whoami)', '100;echo secret', '-1', '999999']:
            with self.assertRaises(ValueError): normalize({'per_species': value})

if __name__ == '__main__': unittest.main()
