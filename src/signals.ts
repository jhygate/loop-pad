type Subscriber = () => void

let subscriber: Subscriber | null = null

export function signal<T>(defaultValue: T) {
  const subscribers = new Set<Subscriber>()
  let value = defaultValue

  return {
    get value(): T {
      if (subscriber) {
        subscribers.add(subscriber)
      }
      return value
    },
    set value(newValue: T) {
      value = newValue
      subscribers.forEach((fn) => fn())
    }
  }
}

export function effect(fn: () => void) {
  const run = () => {
    const previous = subscriber
    subscriber = run
    try {
      fn()
    } finally {
      subscriber = previous
    }
  }
  run()
}
