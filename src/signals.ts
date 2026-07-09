let subscriber: Function | null = null

export function signal<T>(defaultValue: T) {
  const subscribers = new Set<Function>()
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

export function effect(fn: Function) {
  subscriber = fn
  fn()
  subscriber = null
}

export function derived(fn: Function) {
  const derived = signal(fn())
  effect(
    () => {
      derived.value = fn()
    }
  )
  return derived
}

