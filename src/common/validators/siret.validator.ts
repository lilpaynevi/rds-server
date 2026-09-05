import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * Retire espaces, points et tirets : les SIRET sont couramment recopiés depuis
 * un Kbis au format « 123 456 789 00012 ».
 */
export function normalizeSiret(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[\s.-]/g, '') : '';
}

/**
 * Clé de contrôle de Luhn, calculée depuis la droite : pour un nombre de
 * longueur paire (14 chiffres pour un SIRET), cela revient à doubler les
 * chiffres de rang pair en partant de la gauche, ce qui est la règle SIRET.
 */
function isLuhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits.charCodeAt(i) - 48;

    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    double = !double;
  }

  return sum % 10 === 0;
}

/**
 * Valide un SIRET : 14 chiffres + clé de Luhn.
 *
 * Exception documentée par l'INSEE : les établissements de La Poste
 * (SIREN 356000000) ne respectent pas Luhn. Leur règle est que la somme des
 * 14 chiffres doit être un multiple de 5. Sans ce cas particulier, tous les
 * SIRET de La Poste seraient refusés à l'inscription.
 */
export function isValidSiret(value: string): boolean {
  if (!/^\d{14}$/.test(value)) return false;

  if (value.startsWith('356000000')) {
    const sum = value
      .split('')
      .reduce((total, digit) => total + Number(digit), 0);
    return sum % 5 === 0;
  }

  return isLuhnValid(value);
}

export function IsSiret(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSiret',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return isValidSiret(normalizeSiret(value));
        },
        defaultMessage(args: ValidationArguments) {
          const normalized = normalizeSiret(args.value);

          if (!/^\d+$/.test(normalized)) {
            return 'Le SIRET ne doit contenir que des chiffres';
          }
          if (normalized.length !== 14) {
            return `Le SIRET doit comporter 14 chiffres (${normalized.length} saisis)`;
          }
          return 'Le SIRET saisi est invalide (clé de contrôle incorrecte)';
        },
      },
    });
  };
}
