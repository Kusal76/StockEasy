import { CheckCircle, Package, TrendingUp } from 'lucide-react'

const steps = [
  {
    number: '1',
    title: 'Register & Verify',
    description: 'Securely onboard your pharmacy. We verify credentials to maintain a trusted network of medical suppliers.',
    icon: CheckCircle,
  },
  {
    number: '2',
    title: 'Add Your Stock',
    description: 'Input inventory with batch numbers and expiry dates. Our system automatically structures your data for optimal flow.',
    icon: Package,
  },
  {
    number: '3',
    title: 'Sell Smart',
    description: 'AI-driven FEFO alerts ensure you sell nearing-expiry stock first, drastically reducing write-offs.',
    icon: TrendingUp,
  },
]

export function StepsSection() {
  return (
    <section id="features" className="relative py-24 md:py-32 w-full overflow-hidden">
      {/* Subtle Background Elements */}
      <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/10 to-transparent -z-10 hidden md:block" />

      <div className="max-w-[1600px] mx-auto px-6 md:px-16">

        {/* Section Header */}
        <div className="text-center mb-20 animate-in slide-in-from-bottom-8 duration-700">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            Surgical Precision in 3 Steps
          </h2>
          <p className="text-[#bdcabc] max-w-xl mx-auto text-lg leading-relaxed">
            Streamline your supply chain from arrival to sale.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="group relative glass border border-white/5 rounded-2xl p-8 hover:border-primary/40 hover:-translate-y-2 transition-all duration-500 overflow-hidden"
            >
              {/* Giant Background Number */}
              <div className="absolute -bottom-6 -right-6 text-[120px] font-extrabold text-white/5 group-hover:text-primary/5 transition-colors duration-500 font-mono leading-none select-none">
                {step.number}
              </div>

              {/* Corner Accent Glow */}
              <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden rounded-tr-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="absolute -top-12 -right-12 w-full h-full bg-primary/20 blur-2xl rounded-full" />
              </div>

              {/* Icon Container */}
              <div className="w-14 h-14 bg-[#122131] border border-white/10 rounded-xl flex items-center justify-center mb-6 group-hover:border-primary/50 group-hover:shadow-[0_0_20px_rgba(80,200,120,0.3)] transition-all duration-300 relative z-10">
                <step.icon className="w-6 h-6 text-[#bdcabc] group-hover:text-primary transition-colors duration-300" />
              </div>

              {/* Content */}
              <div className="relative z-10">
                <h3 className="text-xl font-bold text-white mb-3 tracking-wide">
                  {step.title}
                </h3>
                <p className="text-[#bdcabc] text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}