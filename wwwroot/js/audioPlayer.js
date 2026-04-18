let audioElement = null;
let dotNetHelper = null;

export function initialize(element, helper) {
    audioElement = element;
    dotNetHelper = helper;
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
    return { currentTime: element.currentTime, duration: element.duration };
}

export function getBufferedPercent(element) {
    if (!element || element.buffered.length === 0) return 0;
    const buffered = element.buffered.end(element.buffered.length - 1);
    return (buffered / element.duration) * 100;
}