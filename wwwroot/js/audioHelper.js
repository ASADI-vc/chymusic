window.audioHelper = {
    getBoundingClientRect: (element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, width: rect.width };
    },
    setCurrentTime: (element, time) => {
        element.currentTime = time;
    },
    setMuted: (element, muted) => {
        element.muted = muted;
    },
    setVolume: (element, volume) => {
        element.volume = volume;
    },
    getTimeInfo: (element) => {
        return { currentTime: element.currentTime, duration: element.duration };
    },
    getBufferedPercent: (element) => {
        if (element.buffered.length > 0) {
            const buffered = element.buffered.end(element.buffered.length - 1);
            return (buffered / element.duration) * 100;
        }
        return 0;
    }
};