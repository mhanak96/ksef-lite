export interface PublicKeyCertificate {
  certificate: string;
  subjectName: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  usage?: string;
}

export interface PublicKeyCertificatesResponse {
  certificates: PublicKeyCertificate[];
  timestamp: string;
}