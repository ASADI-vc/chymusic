let audioElement = null;
let dotNetHelper = null;

export function initialize(element, helper) {
    audioElement = element;
    dotNetHelper = helper;

    if (!audioElement) return;

    audioElement.addEventListener('timeupdate', () => {
        if (dotNetHelper) {
            dotNetHelper.invokeMethodAsync('UpdateTime', audioElement.currentTime, audioElement.duration);
        }
    });

    audioElement.addEventListener('progress', () => {
        if (dotNetHelper && audioElement.buffered.length > 0) {
            const buffered = audioElement.buffered.end(audioElement.buffered.length - 1);
            const percent = (buffered / audioElement.duration) * 100;
            dotNetHelper.invokeMethodAsync('UpdateBuffered', percent);
        }
    });

    audioElement.addEventListener('play', () => {
        if (dotNetHelper) dotNetHelper.invokeMethodAsync('OnPlayStateChanged', true);
    });

    audioElement.addEventListener('pause', () => {
        if (dotNetHelper) dotNetHelper.invokeMethodAsync('OnPlayStateChanged', false);
    });

    audioElement.addEventListener('ended', () => {
        if (dotNetHelper) dotNetHelper.invokeMethodAsync('OnEndedJs');
    });

    audioElement.addEventListener('error', () => {
        // Ignore blob range errors – they don't affect playback
        if (audioElement.src.startsWith('blob:') &&
            audioElement.error && audioElement.error.message.includes('range')) {
            console.debug('Ignoring blob range request error');
            return;
        }
        if (dotNetHelper) dotNetHelper.invokeMethodAsync('OnErrorJs');
    });
}

export function setSource(element, url) {
    if (element) element.src = url;
}

export function play(element) {
    if (element) element.play();
}

export function pause(element) {
    if (element) element.pause();
}

export function seek(element, seconds) {
    if (element) element.currentTime = seconds;
}

export function setVolume(element, volume) {
    if (element) element.volume = volume;
}

export function setMuted(element, muted) {
    if (element) element.muted = muted;
}

export function getBoundingClientRect(element) {
    if (!element) return { left: 0, width: 0 };
    const rect = element.getBoundingClientRect();
    return { left: rect.left, width: rect.width };
}

export function getTimeInfo(element) {
    if (!element) return { currentTime: 0, duration: 0 };
    return { currentTime: element.currentTime || 0, duration: element.duration && isFinite(element.duration) ? element.duration : 0 };
}

export function getBufferedPercent(element) {
    if (!element || element.buffered.length === 0) return 0;
    const buffered = element.buffered.end(element.buffered.length - 1);
    const duration = element.duration && isFinite(element.duration) ? element.duration : 1;
    return (buffered / duration) * 100;
}