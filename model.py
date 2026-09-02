import os
import subprocess


def separate_audio(input_file, output_folder):

    os.makedirs(output_folder, exist_ok=True)

    command = [
        "python",
        "-m",
        "demucs",
        "-n",
        "htdemucs",
        "--mp3",
        "--mp3-bitrate",
        "128",
        "-o",
        output_folder,
        input_file
    ]

    process = subprocess.run(
        command,
        capture_output=True,
        text=True
    )

    if process.returncode != 0:
        raise Exception(process.stderr)

    filename = os.path.basename(input_file)

    song_name = os.path.splitext(filename)[0]

    result_folder = os.path.join(
        output_folder,
        "htdemucs",
        song_name
    )

    stems = {
        "vocals": os.path.join(
            result_folder,
            "vocals.mp3"
        ),

        "drums": os.path.join(
            result_folder,
            "drums.mp3"
        ),

        "bass": os.path.join(
            result_folder,
            "bass.mp3"
        ),

        "other": os.path.join(
            result_folder,
            "other.mp3"
        )
    }

    return stems