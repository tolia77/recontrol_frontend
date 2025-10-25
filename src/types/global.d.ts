export interface Device {
    id: number;
    name: string;
    status: 'Active' | 'Inactive';
    lastUsed: string;
    owner: string;
}