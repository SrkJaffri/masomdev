import type { NavGroup, NavItem } from "@/types/navigation";

export const mainNavigation: NavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "About Us",
    href: "#",
    children: [
      { label: "Our Mission", href: "/our-mission" },
      { label: "Our Committee", href: "/our-members" },
      { label: "Members Portal", href: "/admin/login" },
    ],
  },
  {
    label: "Our Services",
    href: "#",
    children: [
      { label: "Funeral services", href: "/coming-soon" },
      { label: "MASOM Islamic School", href: "/MIS" },
      { label: "Matrimonial services", href: "/coming-soon" },
      { label: "Youth Activities", href: "/coming-soon" },
      { label: "Wadi-e-MASOM", href: "/coming-soon" },
      { label: "MASOM Online Shop", href: "/coming-soon" },
    ],
  },
  {
    label: "Events",
    href: "#",
    children: [
      { label: "Hijri Prayer Calendar", href: "/hijricalendar2026" },
      { label: "Program Calendar", href: "/events-schedule" },
    ],
  },
  {
    label: "Online Forms",
    href: "/forms",
    children: [
      { label: "Online Forms", href: "/forms" },
      { label: "Membership Form", href: "/coming-soon" },
      { label: "Application for Private Program", href: "/private-program-application" },
      { label: "Sura-Fatiha Request", href: "/coming-soon" },
    ],
  },
  {
    label: "Multimedia",
    href: "#",
    children: [
      { label: "Photo Gallery", href: "/coming-soon" },
      { label: "Videos", href: "/coming-soon" },
    ],
  },
  { label: "Contact Us", href: "/contacts" },
];

export const footerNavigation: NavGroup[] = [
  {
    title: "Administration",
    items: [
      { label: "Our Mission", href: "/our-mission" },
      { label: "Our Executive Committee", href: "/our-members" },
      {
        label: "Our Constitution",
        href: "https://masom.com/org/masomByLaws.pdf",
        external: true,
      },
      { label: "MASOM Islamic School", href: "/coming-soon" },
      { label: "Online Forms", href: "/forms" },
    ],
  },
  {
    title: "Useful Links",
    items: [
      { label: "Hijri Prayer Calendar", href: "/hijricalendar2026" },
      { label: "Program Calendar", href: "/events-schedule" },
      { label: "Sura-Fatiha Request", href: "/coming-soon" },
      { label: "Multimedia", href: "/coming-soon" },
      { label: "Contact Us", href: "/contacts" },
    ],
  },
];
