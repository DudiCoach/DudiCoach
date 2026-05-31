"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ExerciseVideo } from "@/lib/data/exercise-video";

// =============================================================================
// TYPES
// =============================================================================

interface VideosResponse {
  data: ExerciseVideo[];
}

interface VideoResponse {
  data: ExerciseVideo;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Fetch all exercise videos.
 */
export function useExerciseVideos() {
  return useQuery({
    queryKey: ["exercise-videos"],
    queryFn: async (): Promise<ExerciseVideo[]> => {
      const response = await fetch("/api/exercise-videos");
      if (!response.ok) {
        throw new Error("Failed to fetch exercise videos");
      }
      const json = (await response.json()) as VideosResponse;
      return json.data;
    },
    staleTime: 60_000,
  });
}

/**
 * Fetch exercise videos by name.
 */
export function useExerciseVideosByName(exerciseName: string) {
  return useQuery({
    queryKey: ["exercise-videos", exerciseName],
    queryFn: async (): Promise<ExerciseVideo[]> => {
      const response = await fetch(
        `/api/exercise-videos?exercise_name=${encodeURIComponent(exerciseName)}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch exercise videos");
      }
      const json = (await response.json()) as VideosResponse;
      return json.data;
    },
    enabled: !!exerciseName,
    staleTime: 60_000,
  });
}

/**
 * Create an exercise video (coach only).
 */
export function useCreateExerciseVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      exercise_name: string;
      youtube_url: string;
      title?: string;
      description?: string;
    }): Promise<ExerciseVideo> => {
      const response = await fetch("/api/exercise-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        throw new Error(json.error ?? "Failed to create video");
      }

      const json = (await response.json()) as VideoResponse;
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercise-videos"] });
    },
  });
}

/**
 * Delete an exercise video (coach only).
 */
export function useDeleteExerciseVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (videoId: string): Promise<void> => {
      const response = await fetch(`/api/exercise-videos/${videoId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        throw new Error(json.error ?? "Failed to delete video");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercise-videos"] });
    },
  });
}
