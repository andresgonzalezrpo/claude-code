// Course types
export interface Course {
  id: number;
  title: string;
  teacher: string;
  duration: number;
  thumbnail: string;
  slug: string;
  average_rating?: number;
  total_ratings?: number;
}

// Rating types
export interface Rating {
  id: number;
  course_id: number;
  rating: number; // 1-5
  review_text?: string;
  created_at: string;
}

export interface RatingSummary {
  ratings: Rating[];
  total: number;
  average: number;
}

export interface RatingCreate {
  rating: number;
  review_text?: string;
}

// Class types
export interface Class {
  id: number;
  title: string;
  description: string;
  video: string;
  duration: number;
  slug: string;
}

// Course Detail type
export interface CourseDetail extends Course {
  description: string;
  classes: Class[];
}

// Progress types
export interface Progress {
  progress: number; // seconds
  user_id: number;
}

// Quiz types
export interface QuizOption {
  id: number;
  answer: string;
  correct: boolean;
}

export interface Quiz {
  id: number;
  question: string;
  options: QuizOption[];
}

// Favorite types
export interface FavoriteToggle {
  course_id: number;
}