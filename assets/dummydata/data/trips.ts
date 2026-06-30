import { Trip } from '../types';

const trips: Trip[] = [
    {
        id: 1,
        numMembers: 4,
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Rainier20200906.jpg/330px-Rainier20200906.jpg',
        name: 'Mount Rainier',
        departureDate: '07/10/2026',
        departureTime: '7:00 AM',
        type: 'single-day'
    },
    {
        id: 2,
        numMembers: 3,
        image: 'https://houston.org/_next/image/?url=https%3A%2F%2Fwpb.houston.org%2Fapp%2Fuploads%2F2025%2F12%2FMM5_FIFA_World_Cup_2026_Ball_02Oct2025_ZU2160-scaled.jpg&w=828&q=75',
        name: 'World Cup Trip',
        departureDate: '07/19/2026',
        departureTime: '7:00 AM',
        type: 'multi-day'
    },
    {
        id: 3,
        numMembers: 1,
        image: '',
        name: 'A Road Trip',
        departureDate: '09/2/2026',
        departureTime: '9:00 AM',
        type: 'multi-day'
    },
    {
        id: 4,
        numMembers: 2,
        image: '',
        name: 'A Road Trip 2',
        departureDate: '10/8/2026',
        departureTime: '2:00 PM',
        type: 'multi-day'
    }


]

export default trips;
