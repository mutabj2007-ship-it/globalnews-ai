"""Offline decoder and acquisition gate regression tests."""
import contextlib, io, json, pathlib, tempfile, unittest
from unittest.mock import patch
import capture
import decode

class GovernedCaptureTests(unittest.TestCase):
    def test_exact_decoder_reproduction(self):
        retained = json.loads((decode.ROOT / 'frontend/src/lib/imihigo/retained.json').read_text(encoding='utf-8'))
        self.assertEqual(decode.decode(), retained)

    def test_capture_refuses_without_explicit_gate_before_network(self):
        with patch('sys.argv', ['capture.py']), patch('urllib.request.urlopen') as network:
            with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                capture.main()
            network.assert_not_called()

    def test_duplicate_capture_refuses_before_network(self):
        with patch('sys.argv', ['capture.py', '--authorize-one-capture']), patch('urllib.request.urlopen') as network:
            with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                capture.main()
            network.assert_not_called()

    def test_parser_refuses_without_gate(self):
        with patch('sys.argv', ['decode.py']), patch.object(decode, 'decode') as decoder:
            with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                decode.main()
            decoder.assert_not_called()

    def test_altered_source_bytes_refused(self):
        with tempfile.TemporaryDirectory(dir=decode.ROOT / 'data/imihigo') as temporary:
            root = pathlib.Path(temporary)
            directory = root / 'data/imihigo'
            directory.mkdir(parents=True)
            metadata = json.loads((decode.ROOT / 'data/imihigo/capture.json').read_text())
            (directory / 'capture.json').write_text(json.dumps(metadata))
            (directory / metadata['artifact']).write_bytes(b'%PDF-corrupted')
            with patch.object(decode, 'ROOT', root), self.assertRaisesRegex(ValueError, 'Exact-source'):
                decode.decode()

if __name__ == '__main__':
    unittest.main()
