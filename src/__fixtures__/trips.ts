import type { Trip } from '@/src/types/trip';

const trips: Trip[] = [
  {
    id: 1,
    numMembers: 4,
    image: 'https://www.thurstontalk.com/wp-content/uploads/2014/04/Mount-Rainier-Sunset.jpg',
    name: 'Mount Rainier',
    departureDate: '07/10/2026',
    departureTime: '7:00 AM',
    duration: 'single-day',
    tripType: 'round-trip',
  },
  {
    id: 2,
    numMembers: 3,
    image:
      'https://houston.org/_next/image/?url=https%3A%2F%2Fwpb.houston.org%2Fapp%2Fuploads%2F2025%2F12%2FMM5_FIFA_World_Cup_2026_Ball_02Oct2025_ZU2160-scaled.jpg&w=828&q=75',
    name: 'World Cup Trip',
    departureDate: '07/19/2026',
    departureTime: '7:00 AM',
    duration: 'multi-day',
    tripType: 'round-trip',
  },
  {
    id: 3,
    numMembers: 1,
    image: '',
    name: 'A Road Trip',
    departureDate: '09/2/2026',
    departureTime: '9:00 AM',
    duration: 'multi-day',
    tripType: 'one-way',
  },
  {
    id: 4,
    numMembers: 2,
    image:
      'https://media.triumphmotorcycles.co.uk/image/upload/f_auto/q_auto:eco/sitecoremedialibrary/media-library/images/motorcycles/usa-disclaimer-heros/classics/scrambler-400-x-my24-family-hero-1-1920x1080-us-disclaimer.jpg',
    name: 'A Trip',
    departureDate: '10/8/2026',
    departureTime: '2:00 PM',
    duration: 'multi-day',
    tripType: 'one-way',
  },
];

export default trips;
