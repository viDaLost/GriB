import unittest

import numpy as np

from calibration import apply_temperature, fit_temperature, negative_log_likelihood


class CalibrationTest(unittest.TestCase):
    def test_underconfidence_can_be_corrected(self):
        p = np.tile([.7, .3], (100, 1))
        truth = np.array([0] * 90 + [1] * 10)
        temperature = fit_temperature(p, truth)
        self.assertLess(temperature, 1)
        calibrated = apply_temperature(p, temperature)
        self.assertAlmostEqual(float(calibrated[:, 0].mean()), .9, delta=.01)
        self.assertLess(negative_log_likelihood(calibrated, truth), negative_log_likelihood(p, truth))

    def test_overconfidence_can_be_corrected(self):
        p = np.tile([.99, .01], (100, 1))
        truth = np.array([0] * 80 + [1] * 20)
        temperature = fit_temperature(p, truth)
        self.assertGreater(temperature, 1)
        self.assertAlmostEqual(float(apply_temperature(p, temperature)[:, 0].mean()), .8, delta=.01)

    def test_calibration_preserves_ranking_and_normalization(self):
        p = np.array([[.05, .25, .7], [.8, .19, .01]])
        for temperature in [.2, .7, 1, 2, 5]:
            calibrated = apply_temperature(p, temperature)
            np.testing.assert_array_equal(p.argsort(axis=1), calibrated.argsort(axis=1))
            np.testing.assert_allclose(calibrated.sum(axis=1), 1)

    def test_invalid_validation_data_is_rejected(self):
        for p, truth in [(np.array([[np.nan, .3]]), np.array([0])),
                         (np.array([[.8, .3]]), np.array([0])),
                         (np.array([[.7, .3]]), np.array([2])),
                         (np.array([[.7, .3]]), np.array([0.0])),
                         (np.empty((0, 2)), np.array([], dtype=int))]:
            with self.assertRaises(ValueError):
                fit_temperature(p, truth)
        for temperature in [0, -1, float('nan')]:
            with self.assertRaises(ValueError):
                apply_temperature(np.array([[.7, .3]]), temperature)


if __name__ == '__main__':
    unittest.main()
