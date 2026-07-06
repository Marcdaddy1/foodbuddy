import { createFileRoute } from '@tanstack/react-router'
import { ProductVerdictScreen } from '../components/ProductVerdictScreen'

export const Route = createFileRoute('/product/$barcode')({
  component: ProductVerdictRoute,
})

function ProductVerdictRoute() {
  const { barcode } = Route.useParams()
  return <ProductVerdictScreen barcode={barcode} />
}
