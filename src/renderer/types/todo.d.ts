export type Priority = 'low' | 'medium' | 'high';

export interface Todo {
  id: string;
  title: string; // 事件（必填）
  completed: boolean;
  createdAt: number;
  dueDate?: number; // 时间（选填）
  dueTime?: string; // 具体时间（选填，HH:mm）
  priority?: Priority; // 优先级（选填）
}

