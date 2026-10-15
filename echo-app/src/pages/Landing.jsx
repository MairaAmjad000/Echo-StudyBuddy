import MarketingHeader from '../components/layout/MarketingHeader.jsx'
import SiteFooter from '../components/layout/SiteFooter.jsx'
import Hero from '../components/landing/Hero.jsx'
import FeaturesSection from '../components/landing/FeaturesSection.jsx'
import UploadFormats from '../components/landing/UploadFormats.jsx'
import ClosingCta from '../components/landing/ClosingCta.jsx'
import useDocumentTitle from '../hooks/useDocumentTitle.js'

export default function Landing() {
  useDocumentTitle('')
  return (
    <>
      <MarketingHeader />
      <main>
        <Hero />
        <FeaturesSection />
        <UploadFormats />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  )
}
