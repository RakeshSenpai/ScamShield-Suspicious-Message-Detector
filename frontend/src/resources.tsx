import { useState } from 'react'
import { topicTranslations } from './resourceTranslations'
import { langIndex, translate } from './i18n'
import type { Language } from './i18n'

const topics = [
  ['accounts', ['Phishing', 'फ़िशिंग', 'ফিছিং'], 'A message leads to a fake sign-in page.', 'An unfamiliar domain, an account threat, or a request to sign in from a message.', 'Open the service through your own bookmark. If you entered a password, change it through the official site and review active sessions.'],
  ['accounts', ['OTP fraud', 'OTP धोखाधड़ी', 'OTP জালিয়াতি'], 'Someone asks for a one-time code that authorizes a login or payment.', 'A caller asks you to read back a code or paste it into a form.', 'Keep codes private. If you shared one, contact the affected service and review recent activity.'],
  ['accounts', ['Bank impersonation', 'बैंक का प्रतिरूपण', 'বেংকৰ ভুৱা পৰিচয়'], 'Someone claims to work for your bank and requests details or an urgent transfer.', 'A KYC deadline, a demand for an OTP, or a request to install remote-access software.', 'Call the number in your official bank app or on your card. Ask the bank to secure affected services if you shared access.'],
  ['payments', ['Fake recruitment', 'नकली नौकरी', 'ভুৱা চাকৰি'], 'A fake recruiter uses a job offer to solicit fees, documents, or software installation.', 'An upfront registration fee, a guaranteed offer, or an unfamiliar verification app.', 'Check the employer’s careers page and contact HR independently. Preserve the offer and receipts if money changed hands.'],
  ['payments', ['Digital arrest scams', 'डिजिटल अरेस्ट धोखाधड़ी', 'ডিজিটেল গ্ৰেপ্তাৰ জালিয়াতি'], 'An impersonator claims you are under investigation and demands money or secrecy.', 'Pressure to stay on a video call, share your screen, or transfer funds.', 'End the call and verify the claim with police through an official contact. Save the call details and report any payment.'],
  ['payments', ['UPI scams', 'UPI धोखाधड़ी', 'UPI জালিয়াতি'], 'Someone tricks you into approving a UPI payment or collect request.', 'A buyer says entering your UPI PIN or scanning their code is required to receive money.', 'Read the amount and payment direction in your app before approving. Report unauthorized transactions to your payment provider or bank.'],
  ['payments', ['Investment fraud', 'निवेश धोखाधड़ी', 'বিনিয়োগ জালিয়াতি'], 'A fake investment platform or adviser takes deposits using fabricated returns.', 'Guaranteed profits, pressure to deposit, or extra fees to withdraw.', 'Verify the intermediary independently. Stop further payments and preserve transaction records if you suspect fraud.'],
  ['shopping', ['Fake shopping websites', 'नकली खरीदारी वेबसाइट', 'ভুৱা বজাৰ ৱেবছাইট'], 'A fake store collects money or card details for goods it may never deliver.', 'An unfamiliar domain, implausibly low prices, or payment through an unrelated personal account.', 'Verify seller information separately and use a protected payment channel. Contact the payment provider if charged.'],
  ['accounts', ['Social media impersonation', 'सोशल मीडिया पर प्रतिरूपण', 'ছ’চিয়েল মিডিয়াত ভুৱা পৰিচয়'], 'Someone copies a profile and solicits money or access from its contacts.', 'A new or duplicate profile sends an urgent request for money.', 'Call the person using a number you already know. Preserve the messages and report the profile through the platform.'],
  ['shopping', ['Online marketplace fraud', 'ऑनलाइन बाज़ार धोखाधड़ी', 'অনলাইন বজাৰ জালিয়াতি'], 'A buyer or seller moves a transaction off the marketplace to misdirect payment or delivery.', 'Advance shipping fees, fake payment confirmations, or requests to move to an unfamiliar app.', 'Keep the transaction on the platform. Check the actual balance in your payment app and report suspicious accounts.'],
] as const

const categories = {
  accounts: ['Accounts and identity', 'खाते और पहचान', 'একাউণ্ট আৰু পৰিচয়'],
  payments: ['Payments and money', 'भुगतान और धन', 'পৰিশোধ আৰু ধন'],
  shopping: ['Shopping and marketplaces', 'खरीदारी और बाज़ार', 'বজাৰ আৰু ক্ৰয়'],
} as const

export function Resources({ language }: { language: Language }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const index = langIndex[language]
  const t = (key: string) => translate(language, key)
  const localized = topics.map(([group, names, ...english], position) => ({
    group, name: names[index], details: index === 0 ? english : topicTranslations[position][index === 1 ? 0 : 1],
  }))
  const visible = localized.filter(({ group, name, details }) => (!category || category === group) &&
    [name, ...details].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
  const labels = [['Warning signs', 'How to respond'], ['चेतावनी के संकेत', 'क्या करें'], ['সতৰ্কতাৰ চিন', 'কি কৰিব']][index]
  return <>
    <h1>{t('resources')}</h1>
    <div className="filters">
      <input type="search" placeholder={t('search')} aria-label={t('search')} value={query} onChange={event => setQuery(event.target.value)}/>
      <select aria-label={t('all')} value={category} onChange={event => setCategory(event.target.value)}>
        <option value="">{t('all')}</option>
        {Object.entries(categories).map(([key, labels]) => <option key={key} value={key}>{labels[index]}</option>)}
      </select>
    </div>
    {visible.map(({ name, details: [description, signs, response] }) => <details key={name} className="panel topic">
      <summary>{name}</summary>
      <p>{description}</p><dl><dt>{labels[0]}</dt><dd>{signs}</dd><dt>{labels[1]}</dt><dd>{response}</dd></dl>
    </details>)}
    {!visible.length && <p role="status">{t('none')}</p>}
  </>
}
