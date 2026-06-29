import { Trip } from '../types';

const trips: Trip[] = [
    {
        id: 245632,
        numMembers: 4,
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Rainier20200906.jpg/330px-Rainier20200906.jpg',
        name: 'Mount Rainier',
        departureDate: '7/10/2026',
        departureTime: '7:00 AM',
        type: 'single-day'
    },
    {
        id: 124356,
        numMembers: 3,
        image: 'https://houston.org/_next/image/?url=https%3A%2F%2Fwpb.houston.org%2Fapp%2Fuploads%2F2025%2F12%2FMM5_FIFA_World_Cup_2026_Ball_02Oct2025_ZU2160-scaled.jpg&w=828&q=75',
        name: 'World Cup Trip',
        departureDate: '7/19/2026',
        departureTime: '7:00 AM',
        type: 'multi-day'
    },
    {
        id: 732894,
        numMembers: 1,
        image: '',
        name: 'A Road Trip',
        departureDate: '9/2/2025',
        departureTime: '9:00 AM',
        type: 'multi-day'
    }

]

export default trips;
