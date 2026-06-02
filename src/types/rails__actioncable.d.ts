// The @rails/actioncable package ships no type declarations and there is no
// installed @types/rails__actioncable. We only use createConsumer, and
// useCableConsumer narrows it to its own CableConsumerLike interface, so a
// minimal declaration is sufficient.
declare module "@rails/actioncable" {
  export function createConsumer(url?: string | (() => string)): unknown;
}
