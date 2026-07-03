import { useEffect, useRef, useState } from 'react';
import { Pause, Play, SkipBack, SkipForward, Volume2, Shuffle, Repeat, Repeat1 } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { query } from '@/lib/db';
import type { Content } from '@chymusic/shared';
import './PlayerBar.css';

export function PlayerBar() {
  const { queue, currentIndex, isPlaying, volume, smartShuffle, repeat } = usePlayerStore();
  const { togglePlay, next, prev, setVolume, toggleSmartShuffle, cycleRepeat } = usePlayerStore();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const [currentContent, setCurrentContent] = useState<Content | null>(null);

  // Load current content from DB.
  useEffect(() => {
    const content = queue[currentIndex];
    if (!content) {
      setCurrentContent(null);
      return;
    }
    setCurrentContent(content);
  }, [queue, currentIndex]);

  // Sync audio element with play state.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch((err) => console.warn('[CHYMUSIC] play() failed:', err));
    } else {
      audio.pause();
    }
  }, [isPlaying, currentIndex]);

  // Sync volume.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Track progress.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.currentTime);
    const onEnded = () => next();
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
    };
  }, [next]);

  const audioSrc = currentContent?.sources?.find((s) => s.type === 'remote')?.url ?? '';

  return (
    <div className="player-bar">
      <audio ref={audioRef} src={audioSrc} />
      <div className="player-bar__info">
        {currentContent ? (
          <>
            <img
              src={currentContent.coverImageUrl ?? '/img/default-cover.svg'}
              alt=""
              className="player-bar__cover"
            />
            <div className="player-bar__meta">
              <div className="player-bar__title">{currentContent.title}</div>
              <div className="player-bar__artist">{currentContent.artist}</div>
            </div>
          </>
        ) : (
          <div className="player-bar__empty">Nothing playing</div>
        )}
      </div>
      <div className="player-bar__controls">
        <button
          className={`player-bar__btn ${smartShuffle ? 'player-bar__btn--active' : ''}`}
          onClick={toggleSmartShuffle}
          title="Smart shuffle"
        >
          <Shuffle size={18} />
        </button>
        <button className="player-bar__btn" onClick={prev} title="Previous">
          <SkipBack size={18} />
        </button>
        <button className="player-bar__btn player-bar__btn--play" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>
        <button className="player-bar__btn" onClick={next} title="Next">
          <SkipForward size={18} />
        </button>
        <button
          className={`player-bar__btn ${repeat !== 'off' ? 'player-bar__btn--active' : ''}`}
          onClick={cycleRepeat}
          title="Repeat"
        >
          {repeat === 'track' ? <Repeat1 size={18} /> : <Repeat size={18} />}
        </button>
      </div>
      <div className="player-bar__volume">
        <Volume2 size={18} />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="player-bar__volume-slider"
        />
      </div>
    </div>
  );
}
