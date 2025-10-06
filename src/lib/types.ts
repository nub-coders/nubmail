
export interface Domain {
    id: string;
    domainName: string;
    verificationStatus: 'verified' | 'pending' | 'failed';
    verificationToken?: string;
    createdAt: string;
    userId: string;
}

export interface EmailAccount {
    id: string;
    emailAddress: string;
    storageQuota: number;
    domainId: string;
}

export interface EmailMessage {
    id: string;
    sender: string;
    recipients: string[];
    subject: string;
    body: string;
    sentAt: string; // ISO date string
    emailAccountId: string;
    read?: boolean;
}
