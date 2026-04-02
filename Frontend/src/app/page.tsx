import styles from "./page.module.scss";
import { Course } from "@/types";
import { Course as CourseComponent } from "@/components/Course/Course";
import Link from "next/link";

async function getCourses(): Promise<Course[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to fetch courses");
  }
  const data = await res.json();
  return data.map((course: { id: number; name: string; thumbnail: string; slug: string; average_rating?: number; total_ratings?: number }) => ({
    ...course,
    title: course.name,
    teacher: "",
    duration: 0,
  }));
}

export default async function Home() {
  const courses = await getCourses();

  return (
    <div className={styles.page}>
      {/* Banner superior */}
      <header className={styles.banner}>
        <span className={styles.bannerRed}>PLATZI</span>
        <span className={styles.bannerBlack}>FLIX</span>
        <span className={styles.bannerSub}>CURSOS</span>
      </header>
      {/* Nombres laterales */}
      <div className={styles.verticalLeft}>PLATZI</div>
      <div className={styles.verticalRight}>FLIX</div>
      {/* Grid de cursos */}
      <main className={styles.main}>
        <div className={styles.coursesGrid}>
          {courses.map((course) => (
            <Link href={`/course/${course.slug}`} key={course.id}>
              <CourseComponent
                id={course.id}
                title={course.title}
                teacher={course.teacher}
                duration={course.duration}
                thumbnail={course.thumbnail}
                average_rating={course.average_rating}
                total_ratings={course.total_ratings}
              />
            </Link>
          ))}
        </div>
      </main>
      {/* Fondo de cuadrícula */}
      <div className={styles.gridBg}></div>
    </div>
  );
}
