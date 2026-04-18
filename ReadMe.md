# 🎵 CHY MUSIC

A modern, self‑hosted music streaming web application built with **Blazor WebAssembly**.  
It serves a scraped music catalog with advanced search, custom playlists, queue management, and offline caching.

![Dark Glassmorphism UI](https://via.placeholder.com/800x400/0d1117/ffffff?text=CHY+MUSIC+Screenshot)

## ✨ Features

- **Browse & Search**  
  Explore thousands of albums and tracks. Search with debouncing, filter by albums, tracks, artists, or genres.

- **Spotify‑like Queue**  
  Add tracks, albums, or playlists to a unified queue. Shuffle, repeat (off/queue/track), reorder, and remove items.

- **Custom Playlists**  
  Create, edit, and delete personal playlists. Add tracks directly from search or album pages.

- **Genres & Artists Pages**  
  Browse all genres and artists, each with dedicated pages showing related albums and popular tracks.

- **Advanced Audio Player**  
  Custom glassmorphism‑styled player with play/pause, seek, volume control, and real‑time progress.

- **Offline Caching**  
  Tracks are cached in **IndexedDB** and optionally to a **user‑selected folder** via the File System Access API.

- **Service Worker**  
  Intercepts audio requests for faster playback and offline support.

- **Responsive Design**  
  Works on desktop and mobile devices with a collapsible sidebar.

## 🛠 Technology Stack

| Layer               | Technology                                                                 |
|---------------------|-----------------------------------------------------------------------------|
| **Frontend**        | Blazor WebAssembly (.NET 10) + Razor Components                             |
| **Styling**         | CSS3 (Glassmorphism, CSS Variables, Flex/Grid)                              |
| **Data Source**     | Static JSON files generated from a SQLite database via Python script         |
| **Caching**         | IndexedDB, CacheStorage API, File System Access API                         |
| **Search**          | Web Worker (background search index)                                        |
| **Playback**        | HTML5 Audio with custom controls + JS interop                               |
| **Service Worker**  | Custom `music-sw.js` for audio caching and CORS handling                    |

## 📁 Project Structure
