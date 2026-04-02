import styles from "./Course.module.scss";
import { Course as CourseType } from "@/types";
import { StarRating } from "@/components/StarRating/StarRating";

type CourseProps = Omit<CourseType, "slug">;

export const Course = ({ title, teacher, duration, thumbnail, average_rating, total_ratings }: CourseProps) => {
  return (
    <article className={styles.courseCard}>
      <div className={styles.thumbnailContainer}>
        <img src={thumbnail} alt={title} className={styles.thumbnail} />
      </div>
      <div className={styles.courseInfo}>
        <h2 className={styles.courseTitle}>{title}</h2>
        <p className={styles.teacher}>Profesor: {teacher}</p>
        <p className={styles.duration}>Duración: {duration} minutos</p>
        {average_rating != null ? (
          <div className={styles.ratingRow}>
            <StarRating rating={average_rating} />
            <span className={styles.ratingValue}>{average_rating.toFixed(1)}</span>
            {total_ratings != null && (
              <span className={styles.totalRatings}>({total_ratings})</span>
            )}
          </div>
        ) : (
          <span className={styles.noRating}>Sin calificaciones</span>
        )}
      </div>
    </article>
  );
};
