import styles from "./StarRating.module.scss";

interface StarRatingProps {
  rating: number;
  maxStars?: number;
}

export const StarRating = ({ rating, maxStars = 5 }: StarRatingProps) => {
  const stars = Array.from({ length: maxStars }, (_, index) => {
    const starValue = index + 1;
    const filled = rating >= starValue - 0.5;
    return filled ? "★" : "☆";
  });

  return (
    <span
      className={styles.starRating}
      role="img"
      aria-label={`${rating} de 5 estrellas`}
    >
      {stars.map((star, index) => (
        <span key={index} className={styles.star}>
          {star}
        </span>
      ))}
    </span>
  );
};
