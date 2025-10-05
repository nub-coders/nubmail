import type { ChartConfig } from "@/components/ui/chart"

export const DASHBOARD_STATS = [
  {
    title: "Total Domains",
    value: "12",
    change: "+2",
    description: "since last month",
  },
  {
    title: "Total Email Accounts",
    value: "73",
    change: "+15",
    description: "since last month",
  },
  {
    title: "Storage Usage",
    value: "45.6 GB",
    change: "75%",
    description: "of 60 GB",
  },
  {
    title: "Emails Sent",
    value: "1,234",
    change: "+12%",
    description: "this week",
  },
];

export const CHART_DATA = [
  { month: "January", desktop: 186 },
  { month: "February", desktop: 305 },
  { month: "March", desktop: 237 },
  { month: "April", desktop: 73 },
  { month: "May", desktop: 209 },
  { month: "June", desktop: 214 },
]

export const CHART_CONFIG = {
  desktop: {
    label: "Usage",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

export const DOMAINS_DATA = [
  {
    domain: "nub-coder.tech",
    status: "verified",
    createdAt: "2023-01-15",
  },
  {
    domain: "example.com",
    status: "pending",
    createdAt: "2023-03-22",
  },
  {
    domain: "another-domain.net",
    status: "verified",
    createdAt: "2023-05-10",
  },
  {
    domain: "failed-verify.org",
    status: "failed",
    createdAt: "2023-06-01",
  },
];

export const ACCOUNTS_DATA: { [key: string]: any[] } = {
  "nub-coder.tech": [
    {
      email: "hello@nub-coder.tech",
      quota: { used: 5.2, total: 10, unit: "GB" },
      status: "active",
    },
    {
      email: "support@nub-coder.tech",
      quota: { used: 1.8, total: 5, unit: "GB" },
      status: "active",
    },
     {
      email: "billing@nub-coder.tech",
      quota: { used: 0.5, total: 5, unit: "GB" },
      status: "inactive",
    },
  ],
  "another-domain.net": [
    {
      email: "contact@another-domain.net",
      quota: { used: 8.9, total: 15, unit: "GB" },
      status: "active",
    },
  ],
};


export const INBOX_DATA = [
  {
    id: "1",
    sender: "Alex Johnson",
    senderEmail: "alex.j@example.com",
    subject: "Project Update & Next Steps",
    snippet: "Just wanted to give you a quick update on the project. We've completed the initial design phase...",
    body: "<p>Hi Team,</p><p>Just wanted to give you a quick update on the project. We've completed the initial design phase and are moving on to development next week. Please review the attached mockups and provide any feedback by EOD Friday.</p><p>Best,<br>Alex</p>",
    timestamp: "2 hours ago",
    read: false,
    folder: "inbox",
  },
  {
    id: "2",
    sender: "Samantha Lee",
    senderEmail: "samantha.lee@example.com",
    subject: "Lunch tomorrow?",
    snippet: "Hey, are you free for lunch tomorrow? Thinking of trying that new Italian place downtown.",
    body: "<p>Hey,</p><p>Are you free for lunch tomorrow? Thinking of trying that new Italian place downtown. Let me know if you're interested!</p><p>Thanks,<br>Sam</p>",
    timestamp: "1 day ago",
    read: true,
    folder: "inbox",
  },
  {
    id: "3",
    sender: "Marketing Team",
    senderEmail: "marketing@example.com",
    subject: "Weekly Newsletter",
    snippet: "Check out our latest product updates, news, and special offers in this week's newsletter.",
    body: "<p>Hello,</p><p>Check out our latest product updates, news, and special offers in this week's newsletter. We have exciting things to share!</p><p>The Marketing Team</p>",
    timestamp: "3 days ago",
    read: true,
    folder: "inbox",
  },
    {
    id: "4",
    sender: "GitHub",
    senderEmail: "noreply@github.com",
    subject: "[nub-coder/nubmail] New issue opened: #42",
    snippet: "A new issue has been opened in the nubmail repository: 'UI Bug in domain management'.",
    body: "<p>Hi there,</p><p>A new issue has been opened in the nubmail repository: 'UI Bug in domain management'. Please take a look when you have a moment.</p><p>Thanks,<br>GitHub Notifier</p>",
    timestamp: "5 days ago",
    read: false,
    folder: "inbox",
  },
];
