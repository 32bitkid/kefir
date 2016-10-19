import combine from './combine';

function collect(source, keys, values) {
  for (var prop in source) {
    if( source.hasOwnProperty( prop ) ) {
      keys.push(prop);
      values.push(source[prop]);
    }
  }
}

export default function combineProps(active, passive, combinator = x => x) {
  if (typeof passive === 'function') {
    combinator = passive;
    passive = [];
  }

  let keys = [],
    activeObservables = [],
    passiveObservables = [];

  collect(active, keys, activeObservables);
  collect(passive, keys, passiveObservables);

  return combine(activeObservables, passiveObservables, (...args) => {
    let event = {};
    for(let i = args.length - 1; 0 <= i; i--) {
      event[keys[i]] = args[i];
    }
    return combinator(event);
  });
}
