import { Food, FoodType } from "./Food";

export function getRandomColor() {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return `rgb(${r}, ${g}, ${b})`;
}

export function updateFood(col: number, row: number, id: number, type: FoodType, food: Array<Food>) {

  const foodToUpdate = food.find(f => f.id === id)
  foodToUpdate?.updateFood({ x: col, y: row }, type)
}