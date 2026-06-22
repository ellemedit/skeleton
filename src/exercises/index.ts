import type { Exercise } from "./types";
import { squat } from "./squat";
import { benchPress } from "./benchPress";
import { deadlift } from "./deadlift";
import { dumbbellCurl } from "./dumbbellCurl";

export type { Exercise, ExerciseInstance, CameraHint } from "./types";
export { squat, benchPress, deadlift, dumbbellCurl };

/** All built-in samples, in display order. */
export const EXERCISES: Exercise[] = [squat, benchPress, deadlift, dumbbellCurl];
