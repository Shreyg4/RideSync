export type Trip = {
    id: number;
    image: string | null;
    name: string;
    departureDate: string;
    departureTime: string;
    type: 'multi-day' | 'single-day';
};