// Cliente central de toasts (sonner). Toda la app notifica por aquí;
// 'sonner' solo se importa en este módulo.
import { toast } from 'sonner'

export const notify = {
  success: (message: string): void => {
    toast.success(message)
  },
  error: (message: string): void => {
    toast.error(message)
  },
  info: (message: string): void => {
    toast.info(message)
  },
}
