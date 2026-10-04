import unittest

from recheck_config import check_source_run, source_run


class RecheckTest(unittest.TestCase):
    def test_source_id_cannot_inject_a_shell_command(self):
        self.assertEqual(source_run({'source_run': 37100012646}), 37100012646)
        for value in [True, 0, -1, '37100012646; echo bad', 10**15]:
            with self.assertRaises(ValueError):
                source_run({'source_run': value})

    def test_only_completed_main_training_runs_are_accepted(self):
        run = {'repository': {'full_name': 'viDaLost/GriB'}, 'path': '.github/workflows/train.yml',
               'head_branch': 'main', 'event': 'push', 'status': 'completed', 'head_sha': 'a' * 40}
        self.assertEqual(check_source_run(run), 'a' * 40)
        self.assertEqual(check_source_run(run | {'path': '.github/workflows/recheck-model.yml'}), 'a' * 40)
        for key, value in [('head_branch', 'other'), ('event', 'pull_request'), ('status', 'in_progress'),
                           ('head_sha', 'a\nanything'), ('path', '.github/workflows/web.yml'),
                           ('repository', {'full_name': 'someone/else'})]:
            with self.assertRaises(ValueError):
                check_source_run(run | {key: value})


if __name__ == '__main__':
    unittest.main()
