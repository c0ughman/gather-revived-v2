import React from 'react';
import { SuccessNotice as SuccessNoticeComponent } from '../modules/pricing';

interface SuccessNoticeProps {
  message: string;
  onClose: () => void;
  autoClose?: boolean;
  duration?: number;
}

export default function SuccessNotice(props: SuccessNoticeProps) {
  return <SuccessNoticeComponent {...props} />;
}