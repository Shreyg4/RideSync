export type Trip = {
    id: number;
    numMembers: number;
    image: string | null;
    name: string;
    departureDate: string;
    departureTime: string;
    type: 'multi-day' | 'single-day';
    form: 'round-trip'| 'one-way';
};

export type Location = {
    name: string;
    address: string;
    type: string;
}