export type StockCourseImageKey = 'stock-golf-1' | 'stock-golf-2' | 'stock-golf-3' | 'stock-golf-4';

export const STOCK_COURSE_IMAGE_KEYS: StockCourseImageKey[] = [
  'stock-golf-1',
  'stock-golf-2',
  'stock-golf-3',
  'stock-golf-4',
];

export const stockCourseImages: Record<StockCourseImageKey, number> = {
  'stock-golf-1': require('../assets/course-images/stock-golf-1.jpg'),
  'stock-golf-2': require('../assets/course-images/stock-golf-2.jpg'),
  'stock-golf-3': require('../assets/course-images/stock-golf-3.jpg'),
  'stock-golf-4': require('../assets/course-images/stock-golf-4.jpg'),
};

export function getCourseImageSource(imageKey: string | null | undefined): number {
  if (imageKey === 'stock-golf-1') return stockCourseImages['stock-golf-1'];
  if (imageKey === 'stock-golf-2') return stockCourseImages['stock-golf-2'];
  if (imageKey === 'stock-golf-3') return stockCourseImages['stock-golf-3'];
  if (imageKey === 'stock-golf-4') return stockCourseImages['stock-golf-4'];
  return stockCourseImages['stock-golf-1'];
}

