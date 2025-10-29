export type Mode = 'interactive' | 'manual';
export type AccordionSection = 'power' | 'terminal' | 'processes';

export interface IconProps {
    className?: string;
}

export interface AccordionItemProps {
    title: string;
    isOpen: boolean;
    onClick: () => void;
}

export interface SidebarProps {
    activeMode: Mode;
    setActiveMode: (mode: Mode) => void;
    openAccordion: AccordionSection | null;
    setOpenAccordion: (item: AccordionSection | null) => void;
}

export interface Frame {
    id: string;
    image: string;
}

export interface Tile {
    id?: string;
    image?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}

export interface MainContentProps {
    disabled: boolean;
    addAction: (action: any) => void;
    frames?: Frame[];
    tiles?: Tile[];
}

