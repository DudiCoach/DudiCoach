"use client";

import { useState } from "react";
import { useExerciseVideos, useCreateExerciseVideo, useDeleteExerciseVideo } from "@/lib/hooks/use-exercise-videos";
import { extractYoutubeId } from "@/lib/data/exercise-video";
import type { ExerciseVideo } from "@/lib/data/exercise-video";

/**
 * Exercise Video Gallery - displays YouTube exercise videos with grid layout.
 * Coaches can add/delete videos. Athletes can view them.
 */
export default function ExerciseVideoGallery() {
  const { data: videos, isLoading } = useExerciseVideos();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  const allVideos = videos ?? [];
  const exerciseNames = [...new Set(allVideos.map((v) => v.exerciseName))].sort();
  const filteredVideos = selectedExercise
    ? allVideos.filter((v) => v.exerciseName === selectedExercise)
    : allVideos;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-foreground text-lg font-semibold">
          Galeria ćwiczeń
        </h2>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-pill px-4 py-2 text-sm font-semibold transition-colors"
        >
          {showAddForm ? "Zamknij" : "Dodaj wideo"}
        </button>
      </div>

      {showAddForm && <AddVideoForm onDone={() => setShowAddForm(false)} />}

      {/* Exercise name filter */}
      {exerciseNames.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedExercise(null)}
            className={`rounded-pill px-3 py-1 text-xs transition-colors ${
              selectedExercise === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Wszystkie ({allVideos.length})
          </button>
          {exerciseNames.map((name) => {
            const count = allVideos.filter((v) => v.exerciseName === name).length;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedExercise(name === selectedExercise ? null : name)}
                className={`rounded-pill px-3 py-1 text-xs transition-colors ${
                  selectedExercise === name
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {isLoading && (
        <p className="text-muted-foreground text-sm">Ładowanie...</p>
      )}

      {!isLoading && filteredVideos.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Brak wideo. Dodaj pierwsze wideo ćwiczenia.
        </p>
      )}

      {filteredVideos.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVideos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}

function VideoCard({ video }: { video: ExerciseVideo }) {
  const deleteMutation = useDeleteExerciseVideo();
  const videoId = extractYoutubeId(video.youtubeUrl);

  return (
    <div className="bg-card border-border rounded-card overflow-hidden border">
      {videoId && (
        <div className="aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      )}
      <div className="p-3">
        <h3 className="text-foreground font-medium text-sm">{video.title}</h3>
        <p className="text-muted-foreground mt-1 text-xs">{video.exerciseName}</p>
        {video.description && (
          <p className="text-muted-foreground mt-1 text-xs">{video.description}</p>
        )}
        <button
          type="button"
          onClick={() => deleteMutation.mutate(video.id)}
          disabled={deleteMutation.isPending}
          className="text-destructive mt-2 text-xs hover:underline disabled:opacity-50"
        >
          Usuń
        </button>
      </div>
    </div>
  );
}

function AddVideoForm({ onDone }: { onDone: () => void }) {
  const [exerciseName, setExerciseName] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const createMutation = useCreateExerciseVideo();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!exerciseName.trim() || !youtubeUrl.trim()) return;

    try {
      await createMutation.mutateAsync({
        exercise_name: exerciseName.trim(),
        youtube_url: youtubeUrl.trim(),
        title: title.trim() || undefined,
        description: description.trim() || undefined,
      });
      setExerciseName("");
      setYoutubeUrl("");
      setTitle("");
      setDescription("");
      onDone();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card border-border rounded-card space-y-3 border p-4">
      <div>
        <label className="text-muted-foreground mb-1 block text-xs font-medium">
          Nazwa ćwiczenia
        </label>
        <input
          type="text"
          value={exerciseName}
          onChange={(e) => setExerciseName(e.target.value)}
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          placeholder="np. Przysiad ze sztangą"
          required
        />
      </div>
      <div>
        <label className="text-muted-foreground mb-1 block text-xs font-medium">
          YouTube URL
        </label>
        <input
          type="url"
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          placeholder="https://www.youtube.com/watch?v=..."
          required
        />
      </div>
      <div>
        <label className="text-muted-foreground mb-1 block text-xs font-medium">
          Tytuł (opcjonalnie)
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Tytuł wideo"
        />
      </div>
      <div>
        <label className="text-muted-foreground mb-1 block text-xs font-medium">
          Opis (opcjonalnie)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Krótki opis"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="bg-secondary text-foreground hover:bg-secondary/80 rounded-pill px-4 py-2 text-sm"
        >
          Anuluj
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending || !exerciseName.trim() || !youtubeUrl.trim()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-pill px-4 py-2 text-sm disabled:opacity-50"
        >
          {createMutation.isPending ? "Dodawanie..." : "Dodaj wideo"}
        </button>
      </div>
    </form>
  );
}
