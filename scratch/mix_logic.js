// Web Audio API logic for mixing stems
let audioContext = null;
let audioBuffers = {};
let currentSource = null;
let mixedBuffer = null;

function getSelectedStems() {
    const selected = document.querySelectorAll('.stem-check:checked');
    return Array.from(selected).map(checkbox => checkbox.value);
}

async function loadAudio(stem) {
    if (audioBuffers[stem]) return audioBuffers[stem];
    
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    const audio = document.getElementById(stem + '-audio');
    if (!audio) return null;
    
    const response = await fetch(audio.src);
    const data = await response.arrayBuffer();
    const buffer = await audioContext.decodeAudioData(data);
    
    audioBuffers[stem] = buffer;
    return buffer;
}

async function createMix() {
    const selected = getSelectedStems();
    const status = document.getElementById('mixStatus');
    
    if (selected.length === 0) {
        if(status) status.innerHTML = '<span style="color: var(--danger)"><i class="ph-bold ph-warning-circle"></i> Please select at least one instrument.</span>';
        return null;
    }
    
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    if(status) status.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Preparing mix...';
    
    const buffers = [];
    for (const stem of selected) {
        const buffer = await loadAudio(stem);
        if(buffer) buffers.push(buffer);
    }
    
    if(buffers.length === 0) return null;
    
    let longestLength = 0;
    let sampleRate = buffers[0].sampleRate;
    
    buffers.forEach(buffer => {
        if (buffer.length > longestLength) longestLength = buffer.length;
    });
    
    const output = audioContext.createBuffer(2, longestLength, sampleRate);
    
    // Mix
    buffers.forEach(buffer => {
        for (let channel = 0; channel < 2; channel++) {
            const outputData = output.getChannelData(channel);
            const sourceChannel = Math.min(channel, buffer.numberOfChannels - 1);
            const inputData = buffer.getChannelData(sourceChannel);
            
            for (let i = 0; i < inputData.length; i++) {
                outputData[i] += inputData[i];
            }
        }
    });
    
    // Normalize to prevent clipping
    for (let channel = 0; channel < 2; channel++) {
        const data = output.getChannelData(channel);
        let max = 0;
        for (let i = 0; i < data.length; i++) {
            max = Math.max(max, Math.abs(data[i]));
        }
        if (max > 1) {
            for (let i = 0; i < data.length; i++) {
                data[i] /= max;
            }
        }
    }
    
    mixedBuffer = output;
    return output;
}

window.playSelected = async function() {
    const status = document.getElementById('mixStatus');
    try {
        const buffer = await createMix();
        if (!buffer) return;
        
        window.stopAudio(); // stop anything playing
        
        currentSource = audioContext.createBufferSource();
        currentSource.buffer = buffer;
        currentSource.connect(audioContext.destination);
        currentSource.start();
        
        if(status) status.innerHTML = '<i class="ph-bold ph-speaker-high"></i> Playing selected instruments...';
        
        currentSource.onended = function () {
            if(status) status.innerHTML = '<i class="ph-bold ph-check"></i> Playback finished';
            currentSource = null;
        };
    } catch (error) {
        console.error(error);
        if(status) status.innerHTML = '<span style="color: var(--danger)"><i class="ph-bold ph-x-circle"></i> Unable to play audio.</span>';
    }
}

window.stopAudio = function() {
    if (currentSource) {
        try { currentSource.stop(); } catch (e) {}
        currentSource = null;
    }
    
    document.querySelectorAll('audio').forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
    
    const status = document.getElementById('mixStatus');
    if (status) status.innerHTML = '<i class="ph-bold ph-stop"></i> Playback stopped';
}

function audioBufferToWav(buffer) {
    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bits = 16;
    const dataSize = buffer.length * channels * 2;
    const arrayBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(arrayBuffer);
    
    function writeString(offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, bits, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    
    let offset = 44;
    const channelData = [];
    for (let channel = 0; channel < channels; channel++) {
        channelData.push(buffer.getChannelData(channel));
    }
    
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < channels; channel++) {
            let sample = channelData[channel][i];
            sample = Math.max(-1, Math.min(1, sample));
            const value = sample < 0 ? sample * 32768 : sample * 32767;
            view.setInt16(offset, value, true);
            offset += 2;
        }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

window.downloadSelected = async function() {
    const status = document.getElementById('mixStatus');
    try {
        const buffer = await createMix();
        if (!buffer) return;
        
        if(status) status.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Encoding audio...';
        
        const wav = audioBufferToWav(buffer);
        const url = URL.createObjectURL(wav);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = 'selected_mix.wav';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        if(status) status.innerHTML = '<i class="ph-bold ph-check-circle"></i> Download started';
    } catch (error) {
        console.error(error);
        if(status) status.innerHTML = '<span style="color: var(--danger)"><i class="ph-bold ph-x-circle"></i> Download failed</span>';
    }
}
