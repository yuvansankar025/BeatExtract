import torchaudio
import torch

try:
    print('Testing torchaudio...')
    torchaudio.get_audio_backend()
    print('Torchaudio is working.')
except Exception as e:
    print(e)
