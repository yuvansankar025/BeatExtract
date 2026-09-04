from flask import (
    Flask,
    render_template,
    request,
    send_file,
    jsonify
)

import os
import uuid

from model import separate_audio


app = Flask(__name__)


# =====================================
# PROJECT DIRECTORIES
# =====================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)


UPLOAD_FOLDER = os.path.join(
    BASE_DIR,
    "uploads"
)


OUTPUT_FOLDER = os.path.join(
    BASE_DIR,
    "outputs"
)


SEPARATED_FOLDER = os.path.join(
    BASE_DIR,
    "separated"
)


os.makedirs(
    UPLOAD_FOLDER,
    exist_ok=True
)


os.makedirs(
    OUTPUT_FOLDER,
    exist_ok=True
)


os.makedirs(
    SEPARATED_FOLDER,
    exist_ok=True
)


# =====================================
# HOME
# =====================================

@app.route("/")
def home():

    return render_template(
        "index.html"
    )


# =====================================
# STUDIO
# =====================================

@app.route("/studio")
def studio():

    return render_template(
        "studio.html"
    )


# =====================================
# START SEPARATION
# =====================================

@app.route("/separate", methods=["POST"])
def separate():
    print("========== /separate CALLED ==========")
    
def separate():

    # Check file

    if "audio" not in request.files:

        return jsonify({
            "error":
            "No audio file selected."
        }), 400


    audio = request.files["audio"]


    if audio.filename == "":

        return jsonify({
            "error":
            "Please select an audio file."
        }), 400


    # =================================
    # Generate unique ID
    # =================================

    file_id = str(
        uuid.uuid4()
    )


    original_name = audio.filename


    extension = os.path.splitext(
        original_name
    )[1].lower()


    allowed_extensions = [
        ".mp3",
        ".wav",
        ".flac",
        ".ogg",
        ".m4a"
    ]


    if extension not in allowed_extensions:

        return jsonify({
            "error":
            "Unsupported audio format."
        }), 400


    filename = (
        file_id +
        extension
    )


    input_path = os.path.join(
        UPLOAD_FOLDER,
        filename
    )


    # Save uploaded audio

    audio.save(
        input_path
    )


    try:

        # =================================
        # RUN AI MODEL
        # =================================

        separate_audio(
            input_path,
            OUTPUT_FOLDER
        )


        # =================================
        # Go to progress page
        # =================================

        return render_template(
            "progress.html",
            session_id=file_id
        )


    except Exception as error:

        print(
            "Separation failed:"
        )

        print(error)


        return jsonify({
            "error":
            str(error)
        }), 500


# =====================================
# RESULTS
# =====================================

@app.route(
    "/results/<session_id>"
)
def results(session_id):

    result_folder = os.path.join(
        OUTPUT_FOLDER,
        "htdemucs",
        session_id
    )


    if not os.path.exists(
        result_folder
    ):

        return (
            "Separated files not found.",
            404
        )


    stems = {}


    allowed_stems = [
        "vocals",
        "drums",
        "bass",
        "other"
    ]


    for stem in allowed_stems:

        file_path = os.path.join(
            result_folder,
            stem + ".mp3"
        )


        if os.path.exists(
            file_path
        ):

            stems[stem] = file_path


    if not stems:

        return (
            "No separated stems found.",
            404
        )


    return render_template(
        "results.html",
        session_id=session_id,
        stems=stems
    )


# =====================================
# DOWNLOAD STEM
# =====================================

@app.route(
    "/download/<session_id>/<stem>"
)
def download_stem(
    session_id,
    stem
):

    allowed_stems = [
        "vocals",
        "drums",
        "bass",
        "other"
    ]


    if stem not in allowed_stems:

        return (
            "Invalid stem.",
            400
        )


    result_folder = os.path.join(
        OUTPUT_FOLDER,
        "htdemucs",
        session_id
    )


    file_path = os.path.join(
        result_folder,
        stem + ".mp3"
    )


    if not os.path.exists(
        file_path
    ):

        return (
            "File not found.",
            404
        )


    return send_file(
        file_path,
        as_attachment=True,
        download_name=(
            stem + ".mp3"
        )
    )


# =====================================
# MIX AND DOWNLOAD
# =====================================

@app.route("/mix_and_download/<session_id>", methods=["POST"])
def mix_and_download(session_id):
    stems = request.json.get("stems", [])
    if not stems:
        return jsonify({"error": "No stems selected."}), 400

    result_folder = os.path.join(OUTPUT_FOLDER, "htdemucs", session_id)
    if not os.path.exists(result_folder):
        return jsonify({"error": "Separated files not found."}), 404

    inputs = []
    for stem in stems:
        file_path = os.path.join(result_folder, stem + ".mp3")
        if os.path.exists(file_path):
            inputs.append(file_path)

    if not inputs:
        return jsonify({"error": "No valid stems found."}), 400
        
    # If only one stem, just return it
    if len(inputs) == 1:
        return send_file(inputs[0], as_attachment=True, download_name="selected_mix.mp3")

    # Use ffmpeg to mix multiple stems
    import subprocess
    import time
    
    mixed_filename = f"mixed_{int(time.time())}.mp3"
    mixed_path = os.path.join(result_folder, mixed_filename)
    
    # Construct ffmpeg command
    cmd = ["ffmpeg", "-y"]
    for inp in inputs:
        cmd.extend(["-i", inp])
        
    # Filter complex for mixing
    cmd.extend([
        "-filter_complex",
        f"amix=inputs={len(inputs)}:duration=longest",
        mixed_path
    ])
    
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return send_file(mixed_path, as_attachment=True, download_name="selected_mix.mp3")
    except Exception as e:
        return jsonify({"error": "Mixing failed."}), 500


# =====================================
# START FLASK
# =====================================

if __name__ == "__main__":

    port = int(os.environ.get("PORT", 10000))

    print("")
    print("================================")
    print(" AI MUSIC SOURCE SEPARATOR")
    print("================================")
    print("Server starting...")
    print(f"Server running on port {port}")
    print("================================")
    print("")

    app.run(
        host="0.0.0.0",
        port=port,
        debug=False )

