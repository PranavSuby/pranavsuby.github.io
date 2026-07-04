import VIDEOS from '../data/exercise-videos.json';

// Stable lookup key for an exercise name.
function key(name) {
  return (name || '').trim().toLowerCase();
}

// A specific, verified how-to video for this exercise if we have one on file. A custom
// exercise can also carry its own `videoUrl`. Returns { url, title, channel } or null.
export function getExerciseVideo(exercise) {
  if (!exercise) return null;
  if (exercise.videoUrl) return { url: exercise.videoUrl, title: exercise.name, channel: '' };
  return VIDEOS[key(exercise.name)] || null;
}

// A YouTube search deep-link — the universal fallback so every exercise has a working
// "watch how-to" option even before a specific video has been verified for it.
export function youtubeSearchUrl(name) {
  const q = `how to ${name || ''} exercise proper form`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}
